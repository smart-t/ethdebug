AUTHOR=banking
NAME=ethdebug
VERSION=latest
SUBNET=10.0.42

build:
	docker build -t $(AUTHOR)/$(NAME):$(VERSION) .

start:
	docker run -d --name=ethdebug --net icec --ip $(SUBNET).241 -p 8003:8003 $(AUTHOR)/$(NAME):$(VERSION) http://$(SUBNET).1:8545

stop:
	docker stop ethdebug

clean:
	docker rm ethdebug

network:
	docker network create --subnet $(SUBNET).0/24 --gateway $(SUBNET).254 $(NETWORKNAME)

rmnetwork:
	docker network rm $(NETWORKNAME)

help:
	@echo "Start banking/ethdebug:latest, navigate to http://127.0.0.1:8003/list"

