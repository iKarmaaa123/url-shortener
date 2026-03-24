FROM golang:1.24-alpine AS build

WORKDIR /wd

COPY go.mod .

RUN go mod download

COPY main.go .

RUN go build -o /main.go

FROM golang:1.19-alpine

RUN adduser non-root

USER non-root

WORKDIR /app

COPY --from=build /wd .

EXPOSE 8081

CMD ["main.go"]