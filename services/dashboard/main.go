package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

var db *sql.DB
var rdb *redis.Client
var ctx = context.Background()

func main() {
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
	waitForDB()

	// Initialize Redis connection
	redisEndpoint := os.Getenv("REDIS_ENDPOINT")
	if redisEndpoint != "" {
		rdb = redis.NewClient(&redis.Options{
			Addr:     redisEndpoint,
			Password: "", // ElastiCache Redis typically doesn't use password in VPC
			DB:       0,
		})
		
		// Test Redis connection
		if err := rdb.Ping(ctx).Err(); err != nil {
			log.Printf("Warning: Failed to connect to Redis: %v. Continuing without cache.", err)
			rdb = nil
		} else {
			log.Println("Successfully connected to Redis!")
		}
	} else {
		log.Println("REDIS_ENDPOINT not set, running without cache")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/summary", handleSummary)
	mux.HandleFunc("/url/", handleURLStats)
	mux.HandleFunc("/recent", handleRecent)
	mux.HandleFunc("/top", handleTop)

	port := getEnv("PORT", "8081")
	log.Printf("Dashboard API listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	status := "ok"
	redisStatus := "not_configured"
	
	if err := db.Ping(); err != nil {
		status = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	
	// Check Redis connection if available
	if rdb != nil {
		if err := rdb.Ping(ctx).Err(); err != nil {
			redisStatus = "unhealthy"
		} else {
			redisStatus = "ok"
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":       status,
		"service":      "dashboard",
		"redis_status": redisStatus,
	})
}

func handleSummary(w http.ResponseWriter, r *http.Request) {
	cacheKey := "dashboard:summary"
	
	// Try to get from Redis cache first
	if rdb != nil {
		cached, err := rdb.Get(ctx, cacheKey).Result()
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write([]byte(cached))
			return
		}
	}

	// Cache miss - query database
	today := time.Now().UTC().Truncate(24 * time.Hour)

	var totalURLs, totalClicks, clicksToday int
	db.QueryRow("SELECT COUNT(*) FROM urls").Scan(&totalURLs)
	db.QueryRow("SELECT COALESCE(SUM(clicks), 0) FROM urls").Scan(&totalClicks)
	db.QueryRow(
		"SELECT COALESCE(SUM(clicks), 0) FROM click_stats_hourly WHERE hour >= $1",
		today,
	).Scan(&clicksToday)

	result := map[string]interface{}{
		"total_urls":   totalURLs,
		"total_clicks": totalClicks,
		"clicks_today": clicksToday,
	}

	resultJSON, _ := json.Marshal(result)

	// Store in Redis cache with 30 second TTL
	if rdb != nil {
		rdb.Set(ctx, cacheKey, resultJSON, 30*time.Second)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(resultJSON)
}

func handleURLStats(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimPrefix(r.URL.Path, "/url/")
	if code == "" {
		httpError(w, "provide a short code", http.StatusBadRequest)
		return
	}

	cacheKey := fmt.Sprintf("dashboard:url:%s", code)
	
	// Try to get from Redis cache first
	if rdb != nil {
		cached, err := rdb.Get(ctx, cacheKey).Result()
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write([]byte(cached))
			return
		}
	}

	// Cache miss - query database
	var url string
	var clicks int
	var createdAt string
	err := db.QueryRow(
		"SELECT url, clicks, created_at FROM urls WHERE id = $1", code,
	).Scan(&url, &clicks, &createdAt)
	if err != nil {
		httpError(w, "not found", http.StatusNotFound)
		return
	}

	// Hourly stats for last 24 hours
	rows, err := db.Query(
		`SELECT hour, clicks FROM click_stats_hourly
		 WHERE short_code = $1 AND hour >= NOW() - INTERVAL '24 hours'
		 ORDER BY hour DESC`,
		code,
	)

	type HourlyStat struct {
		Hour   string `json:"hour"`
		Clicks int    `json:"clicks"`
	}

	hourly := []HourlyStat{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var h HourlyStat
			rows.Scan(&h.Hour, &h.Clicks)
			hourly = append(hourly, h)
		}
	}

	result := map[string]interface{}{
		"short_code":   code,
		"url":          url,
		"total_clicks": clicks,
		"created_at":   createdAt,
		"hourly":       hourly,
	}

	resultJSON, _ := json.Marshal(result)

	// Store in Redis cache with 2 minute TTL
	if rdb != nil {
		rdb.Set(ctx, cacheKey, resultJSON, 2*time.Minute)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(resultJSON)
}

func handleRecent(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(
		`SELECT short_code, ip_address, user_agent, clicked_at
		 FROM click_events ORDER BY clicked_at DESC LIMIT 50`,
	)
	if err != nil {
		httpError(w, "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Click struct {
		ShortCode string `json:"short_code"`
		IP        string `json:"ip"`
		UserAgent string `json:"user_agent"`
		ClickedAt string `json:"clicked_at"`
	}

	clicks := []Click{}
	for rows.Next() {
		var c Click
		rows.Scan(&c.ShortCode, &c.IP, &c.UserAgent, &c.ClickedAt)
		clicks = append(clicks, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(clicks)
}

func handleTop(w http.ResponseWriter, r *http.Request) {
	cacheKey := "dashboard:top"
	
	// Try to get from Redis cache first
	if rdb != nil {
		cached, err := rdb.Get(ctx, cacheKey).Result()
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write([]byte(cached))
			return
		}
	}

	// Cache miss - query database
	rows, err := db.Query(
		"SELECT id, url, clicks FROM urls ORDER BY clicks DESC LIMIT 10",
	)
	if err != nil {
		httpError(w, "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type TopURL struct {
		ShortCode string `json:"short_code"`
		URL       string `json:"url"`
		Clicks    int    `json:"clicks"`
	}

	top := []TopURL{}
	for rows.Next() {
		var t TopURL
		rows.Scan(&t.ShortCode, &t.URL, &t.Clicks)
		top = append(top, t)
	}

	resultJSON, _ := json.Marshal(top)

	// Store in Redis cache with 1 minute TTL
	if rdb != nil {
		rdb.Set(ctx, cacheKey, resultJSON, 60*time.Second)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(resultJSON)
}

func httpError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
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
