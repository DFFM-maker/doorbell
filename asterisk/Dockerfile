FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    asterisk \
    && rm -rf /var/lib/apt/lists/*

# DTLS certificate for WebRTC (webapp peer)
RUN mkdir -p /etc/asterisk/keys
COPY asterisk.pem /etc/asterisk/keys/asterisk.pem

# Config files — pjsip sostituisce chan_sip per WebSocket/WebRTC
COPY pjsip.conf      /etc/asterisk/pjsip.conf
COPY modules.conf    /etc/asterisk/modules.conf
COPY extensions.conf /etc/asterisk/extensions.conf
COPY http.conf       /etc/asterisk/http.conf
COPY rtp.conf        /etc/asterisk/rtp.conf
COPY manager.conf    /etc/asterisk/manager.conf

# Svuota sip.conf — chan_sip è disabilitato in modules.conf
RUN echo "; chan_sip disabled" > /etc/asterisk/sip.conf

EXPOSE 5060/udp 8088/tcp 5038/tcp 10000-10050/udp

CMD ["asterisk", "-f"]
