FROM debian:stretch

ENV DOCKER=18.06.0-ce

WORKDIR /

RUN apt-get update
RUN apt-get install -y wget curl lsb-release gnupg

RUN wget -O docker.tgz https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER}.tgz
RUN tar -xf docker.tgz

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -

RUN export CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)" \
    && echo "deb https://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -

RUN apt-get update


FROM debian:stretch
WORKDIR /
COPY --from=0 /docker/* /usr/local/bin/
COPY --from=0 /etc/apt /etc/apt
COPY --from=0 /var/lib/apt/lists/ /var/lib/apt/lists/

RUN apt-get install -y apt-transport-https python-pip \
    && apt-get install -y --no-install-recommends python nodejs google-cloud-sdk kubectl git \
    && pip install -U --no-cache-dir awscli \
    && NODE_ENV=production npm install yargs \
    && apt-get purge -y --auto-remove apt-transport-https python-pip

ADD ./portainer-deploy.js /usr/local/bin/portainer-deploy
