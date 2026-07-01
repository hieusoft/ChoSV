package publisher

import (
	"context"
	"encoding/json"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type RabbitMQ struct {
	conn *amqp.Connection
	ch   *amqp.Channel
}

func NewRabbitMQ(url string) (*RabbitMQ, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}
	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}
	// Declare exchange
	err = ch.ExchangeDeclare("hieusoft.events", "topic", true, false, false, false, nil)
	if err != nil {
		return nil, err
	}
	return &RabbitMQ{conn: conn, ch: ch}, nil
}

func (r *RabbitMQ) Publish(routingKey string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return r.ch.PublishWithContext(ctx,
		"hieusoft.events",
		routingKey,
		false, false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
			Timestamp:   time.Now(),
		},
	)
}

func (r *RabbitMQ) PublishUserRegistered(userID, email, fullName string) {
	err := r.Publish("user.registered", map[string]interface{}{
		"event":     "UserRegistered",
		"user_id":   userID,
		"email":     email,
		"full_name": fullName,
		"timestamp": time.Now().Format(time.RFC3339),
	})
	if err != nil {
		log.Printf("Failed to publish user.registered: %v", err)
	}
}

func (r *RabbitMQ) Close() {
	r.ch.Close()
	r.conn.Close()
}
