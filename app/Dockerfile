FROM python:3.11-slim as build

WORKDIR /wd

COPY requirements.txt .

RUN pip install --prefix=/out -r requirements.txt

COPY /src .

FROM gcr.io/distroless/python3-debian12

WORKDIR /app

COPY --from=build /wd .

COPY --from=build /out/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

ENV PYTHONPATH=/usr/local/lib/python3.11/site-packages \
    TABLE_NAME=url-shortener-table 

EXPOSE 8080

CMD ["-m", "uvicorn", "main:app", "--host=0.0.0.0", "--port=8080"]