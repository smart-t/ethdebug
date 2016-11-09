FROM node:latest
MAINTAINER Maxim B. Belooussov <belooussov@gmail.com>
ENV DEBIAN_FRONTEND noninteractive
RUN git clone https://github.com/ing-bank/ethdebug && \
    cd /ethdebug && \
    npm install
EXPOSE 8003
WORKDIR /ethdebug
ENTRYPOINT ["npm","start"]
