"use strict";

const Telegraf = require ('telegraf')
    , storage = require('./subscribers')
    , log  = require ('ololog').configure({ locate: false, time:true })
    , ansi = require ('ansicolor').nice;

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.start((ctx) => {
    let newSubscriber = ctx.message.from
    storage.addSubscriber(newSubscriber)
})

bot.startPolling();

module.exports = {
    //TODO: HTML Messages
    //TODO: TradingView Chart
    sendSignal: function(message) {
        log.dim.blue('Sending Telegram signal', message.yellow)
        storage.getSubscribers().then((subscribers) => {
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
