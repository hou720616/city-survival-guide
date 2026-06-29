import multiprocessing

bind = "0.0.0.0:8000"
workers = 2
worker_class = "uvicorn.workers.UvicornWorker"
threads = 1

timeout = 120
keepalive = 2

accesslog = "./logs/access.log"
errorlog = "./logs/error.log"
loglevel = "info"

max_requests = 1000
max_requests_jitter = 100

daemon = False