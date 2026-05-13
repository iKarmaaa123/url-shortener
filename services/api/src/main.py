from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
import os, hashlib, time, json
from db import put_mapping, get_mapping, get_backend_type, increment_clicks
from events import publish_click_event
import redis

app = FastAPI()

# Initialize Redis connection
redis_client = None
redis_endpoint = os.environ.get("REDIS_ENDPOINT")
if redis_endpoint:
    try:
        redis_client = redis.Redis(
            host=redis_endpoint.split(":")[0] if ":" in redis_endpoint else redis_endpoint,
            port=int(redis_endpoint.split(":")[1]) if ":" in redis_endpoint and len(redis_endpoint.split(":")) > 1 else 6379,
            db=0,
            decode_responses=True,
            socket_connect_timeout=5
        )
        # Test connection
        redis_client.ping()
        print(f"Successfully connected to Redis at {redis_endpoint}")
    except Exception as e:
        print(f"Warning: Failed to connect to Redis: {e}. Continuing without cache.")
        redis_client = None
else:
    print("REDIS_ENDPOINT not set, running without cache")

def get_url_data(short_id: str):
    """Get URL data - checks cache first, then database"""
    # Try cache first
    if redis_client:
        try:
            cached = redis_client.get(f"url:{short_id}")
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Redis get error: {e}")
    
    # Cache miss - get from database
    item = get_mapping(short_id)
    if item:
        # Cache for future requests (1 hour TTL)
        if redis_client:
            try:
                redis_client.setex(f"url:{short_id}", 3600, json.dumps(item))
            except Exception as e:
                print(f"Redis set error: {e}")
    
    return item

@app.get("/healthz")
def health():
    redis_status = "not_configured"
    if redis_client:
        try:
            redis_client.ping()
            redis_status = "ok"
        except:
            redis_status = "unhealthy"
    
    return {
        "status": "ok",
        "ts": int(time.time()),
        "db": get_backend_type(),
        "redis_status": redis_status
    }


@app.post("/shorten")
async def shorten(req: Request):
    body = await req.json()
    url = body.get("url")
    if not url:
        raise HTTPException(400, "url required")
    short = hashlib.sha256(url.encode()).hexdigest()[:8]
    
    # Store in database
    put_mapping(short, url)
    
    # Cache the new URL data
    if redis_client:
        try:
            data = {"id": short, "url": url, "clicks": 0}
            redis_client.setex(f"url:{short}", 3600, json.dumps(data))
        except Exception as e:
            print(f"Redis cache error: {e}")
    
    base_url = os.environ.get("BASE_URL", "")
    return {"short": short, "url": url, "short_url": f"{base_url}/{short}" if base_url else short}


@app.get("/stats/{short_id}")
def stats(short_id: str):
    # Get data (checks cache first, then database)
    item = get_url_data(short_id)
    if not item:
        raise HTTPException(404, "not found")
    
    return {"short": short_id, "url": item["url"], "clicks": item.get("clicks", 0)}


@app.get("/{short_id}")
def resolve(short_id: str, request: Request):
    # Get data (checks cache first, then database)
    item = get_url_data(short_id)
    if not item:
        raise HTTPException(404, "not found")

    # Increment click count in database
    increment_clicks(short_id)

    # Publish click event to SQS for analytics processing
    publish_click_event(
        short_code=short_id,
        ip=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", ""),
        referer=request.headers.get("referer", ""),
    )

    return RedirectResponse(item["url"])