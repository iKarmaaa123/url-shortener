FROM golang:1.26-alpine AS build

WORKDIR /wd

COPY go.mod .

RUN go mod download all

COPY main.go .

RUN go build -o app main.go

FROM golang:1.19-alpine

WORKDIR /app

COPY --from=build /wd/app .

EXPOSE 8081

CMD ["./app"]