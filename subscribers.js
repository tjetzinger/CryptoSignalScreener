const storage = require('node-persist')
    , config = require('config')
    , log  = require ('ololog').configure ({ locate: false, time: true });

    const subscribers = storage.create({ dir: config.App.dirSubscriberStorage })

module.exports = {
    init: async function() {
        await subscribers.init()
    },
    addSubscriber: async function(newSubscriber) {
        await subscribers.set(newSubscriber.id.toString(), newSubscriber)
        log.dim.blue(newSubscriber.username, 'has subscribed')
    },
    removeSubscriber: async function(subscriberId) {
        await subscribers.del(subscriberId)
        log.dim.blue(subscriberId, 'has been removed')
    },
    getSubscribers: async function () {
        return await subscribers.keys()
    }
};
