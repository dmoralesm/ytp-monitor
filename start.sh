#!/usr/bin/with-contenv sh

echo "Create config file..."
CONF_FILE=src/conf.json

mv src/conf.sample.json $CONF_FILE
sed -i "s/YTP_LOGIN/$YTP_LOGIN/g" $CONF_FILE
sed -i "s/YTP_PASSWORD/$YTP_PASSWORD/g" $CONF_FILE
sed -i "s/SMTP_HOST/$SMTP_HOST/g" $CONF_FILE
sed -i "s/SMTP_PORT/$SMTP_PORT/g" $CONF_FILE
sed -i "s/SMTP_USER/$SMTP_USER/g" $CONF_FILE
sed -i "s/SMTP_PASSWORD/$SMTP_PASSWORD/g" $CONF_FILE
sed -i "s/TO_EMAIL/$TO_EMAIL/g" $CONF_FILE

echo "Start app..."
npm start
