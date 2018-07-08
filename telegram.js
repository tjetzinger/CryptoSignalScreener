// TODO: Sign up user
// TODO: Store user id in db
// TODO: Send alerts to all users

const Telegraf = require ('telegraf')
    , log  = require ('ololog').configure ({ locate: false });

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
bot.use((ctx) => {
    log(ctx.message)
})
bot.startPolling();

module.exports = {
    sendAlert: function(message) {
        // TODO: Remove chat id
        bot.telegram.sendMessage(291564174, message)
        //bot.telegram.sendMessage(581929366, message)
    }
};
