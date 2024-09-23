FROM docker.elastic.co/beats/filebeat:8.11.1

COPY filebeat.yml /usr/share/filebeat/filebeat.yml

USER root
RUN chown -R root /usr/share/filebeat/
USER filebeat
