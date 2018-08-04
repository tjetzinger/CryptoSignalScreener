const Telegraf = require ('telegraf')
    , storage = require('./storage')
    , log  = require ('ololog').configure({ locate: false, time:true });

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.start((ctx) => {
    let newSubscriber = ctx.message.from
    storage.addSubscriber(newSubscriber)
})

bot.startPolling();

module.exports = {
    sendAlert: function(message) {
        storage.getSubscribers().then(function (subscribers) {
            subscribers.forEach(function (subscriber) {
                bot.telegram.sendMessage(subscriber, message).catch((err) => {
                    if(err.code == 403) { // Forbidden
                        storage.removeSubscriber(subscriber)
                    }
                    else {
                        log.bright.red.error(err)
                    }
                })
            })
        })

    }
};
