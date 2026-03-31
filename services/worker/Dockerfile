FROM golang:1.26-alpine AS build

WORKDIR /wd

RUN apk add --no-cache git 

COPY go.mod .

RUN go mod download all

COPY main.go .

RUN go build -o app main.go

FROM golang:1.19-alpine

WORKDIR /app

COPY --from=build /wd/app .

CMD ["./app"]