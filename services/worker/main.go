package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sqs"
	_ "github.com/lib/pq"
)

var db *sql.DB
var sqsClient *sqs.SQS

type ClickEvent struct {
	ShortCode string `json:"short_code"`
	IP        string `json:"ip"`
	UserAgent string `json:"user_agent"`
	Referer   string `json:"referer"`
	Timestamp string `json:"timestamp"`
}

func main() {
	sess := session.Must(session.NewSession(&aws.Config{
	}))
	sqsClient = sqs.New(sess)

dbSecretJSON := os.Getenv("DB_CREDENTIALS")
if dbSecretJSON == "" {
    log.Fatal("DB_CREDENTIALS is required")
}

type DBSecret struct {
    Username string `json:"username"`
    Password string `json:"password"`
    Host     string `json:"host"`
    Port     int    `json:"port"`
    DBName   string `json:"dbname"`
}

var dbSecret DBSecret
if err := json.Unmarshal([]byte(dbSecretJSON), &dbSecret); err != nil {
    log.Fatalf("Failed to parse DB_SECRET: %v", err)
}

log.Printf("Connecting to database at %s:%d (user: %s, dbname: %s)", dbSecret.Host, dbSecret.Port, dbSecret.Username, dbSecret.DBName)

dbURL := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=require",
    url.QueryEscape(dbSecret.Username),
    url.QueryEscape(dbSecret.Password),
    dbSecret.Host,
    dbSecret.Port,
    dbSecret.DBName,
)

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(3)
	db.SetConnMaxLifetime(5 * time.Minute)
	waitForDB()
	migrate()

	sqsQueue := os.Getenv("SQS_QUEUE_URL")
	if sqsQueue == "" {
		log.Fatal("SQS_QUEUE_URL is required")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Health check endpoint
	go func() {
		mux := http.NewServeMux()
		mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
			status := "ok"
			if err := db.Ping(); err != nil {
				status = "unhealthy"
				w.WriteHeader(http.StatusServiceUnavailable)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": status, "service": "worker"})
		})
		port := getEnv("HEALTH_PORT", "8090")
		log.Printf("Worker health check on :%s", port)
		http.ListenAndServe(":"+port, mux)
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("Shutting down worker...")
		cancel()
	}()

	log.Println("Analytics worker started, polling SQS...")
	pollSQS(ctx, sqsQueue)
}

func migrate() {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS click_events (
			id SERIAL PRIMARY KEY,
			short_code VARCHAR(16) NOT NULL,
			ip_address VARCHAR(45),
			user_agent TEXT,
			referer TEXT,
			clicked_at TIMESTAMP NOT NULL,
			processed_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_click_events_short_code ON click_events(short_code)`,
		`CREATE INDEX IF NOT EXISTS idx_click_events_clicked_at ON click_events(clicked_at)`,
		`CREATE TABLE IF NOT EXISTS click_stats_hourly (
			short_code VARCHAR(16) NOT NULL,
			hour TIMESTAMP NOT NULL,
			clicks INTEGER DEFAULT 0,
			unique_ips INTEGER DEFAULT 0,
			PRIMARY KEY (short_code, hour)
		)`,
	}
	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			log.Fatalf("Migration failed: %v", err)
		}
	}
	log.Println("Worker migrations complete")
}

func pollSQS(ctx context.Context, queueURL string) {
	for {
		select {
		case <-ctx.Done():
			log.Println("Worker stopped")
			return
		default:
			messages, err := receiveSQSMessages(queueURL)
			if err != nil {
				log.Printf("Failed to receive messages: %v", err)
				time.Sleep(5 * time.Second)
				continue
			}
			for _, msg := range messages {
				if msg.Body == nil {
					continue
				}
				if err := processClickEvent(*msg.Body); err != nil {
					log.Printf("Failed to process event: %v", err)
					continue
				}
				// Delete message from queue after successful processing
				if err := deleteSQSMessage(queueURL, msg); err != nil {
					log.Printf("Failed to delete message: %v", err)
				} else {
					log.Printf("Processed click event")
				}
			}
			if len(messages) == 0 {
				time.Sleep(5 * time.Second)
			}
		}
	}
}

func receiveSQSMessages(queueURL string) ([]*sqs.Message, error) {
	// Students implement with AWS SDK SQS ReceiveMessage
	
	// Use long polling: WaitTimeSeconds = 20
	// MaxNumberOfMessages = 10

	resp, err := sqsClient.ReceiveMessage(&sqs.ReceiveMessageInput{
		QueueUrl: aws.String(queueURL),
		WaitTimeSeconds:aws.Int64(20),
		VisibilityTimeout: aws.Int64(30),
		MaxNumberOfMessages: aws.Int64(10),
	})
	if err != nil {
		return nil, err
	}
	return resp.Messages, nil
}

func deleteSQSMessage(queueURL string, message *sqs.Message) error {
	_, err := sqsClient.DeleteMessage(&sqs.DeleteMessageInput{
		QueueUrl: aws.String(queueURL),
		ReceiptHandle: message.ReceiptHandle,
	})
	return err
}

func processClickEvent(raw string) error {
	var event ClickEvent
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		return err
	}

	clickedAt, err := time.Parse(time.RFC3339, event.Timestamp)
	if err != nil {
		clickedAt = time.Now().UTC()
	}

	// Insert raw click event
	_, err = db.Exec(
		`INSERT INTO click_events (short_code, ip_address, user_agent, referer, clicked_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		event.ShortCode, event.IP, event.UserAgent, event.Referer, clickedAt,
	)
	if err != nil {
		return err
	}

	// Update hourly aggregation
	hour := clickedAt.Truncate(time.Hour)
	_, err = db.Exec(
		`INSERT INTO click_stats_hourly (short_code, hour, clicks, unique_ips)
		 VALUES ($1, $2, 1, 1)
		 ON CONFLICT (short_code, hour)
		 DO UPDATE SET clicks = click_stats_hourly.clicks + 1`,
		event.ShortCode, hour,
	)

	return err
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func waitForDB() {
	for i := 0; i < 30; i++ {
		err := db.Ping()
		if err == nil {
			log.Println("Successfully connected to database!")
			return
		}
		log.Printf("Waiting for database... (%d/30) - Error: %v", i+1, err)
		time.Sleep(time.Second)
	}
	log.Fatal("Database not ready after 30s")
}
