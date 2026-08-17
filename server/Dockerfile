# ============================================================
# Kvario-servern
#
# Flyttad hit från Railway av ett enda skäl: Railway släpper inte
# ut SMTP. Både 465 och 587 gick i timeout därifrån, medan samma
# värd svarar på en halv sekund från en vanlig uppkoppling.
#
# Bygg och kör:
#   fly deploy
# ============================================================

FROM node:22-alpine

# Alpine saknar tidszonsdata. Utan den blir varje datum servern
# räknar ut UTC — och deklarationsdatumen, som hela påminnelsen
# bygger på, skulle hamna en timme fel halva året.
RUN apk add --no-cache tzdata
ENV TZ=Europe/Stockholm

WORKDIR /app

# package-filerna först, källkoden sedan. Docker cachar per steg, så
# beroendena installeras bara om när de faktiskt ändrats — inte varje
# gång en rad i server.js rörts.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Kör som en vanlig användare. Node-avbilden har redan en.
USER node

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
