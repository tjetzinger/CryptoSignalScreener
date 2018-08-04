const storage = require('node-persist')
    , log  = require ('ololog').configure ({ locate: false, time: true });

module.exports = {
    init: async function() {
        await storage.init({ dir: 'data/subscriber' });
    },
    addSubscriber: async function(newSubscriber) {
        await storage.set(newSubscriber.id.toString(), newSubscriber)
        log.dim.blue(newSubscriber.username, 'has subscribed')
    },
    removeSubscriber: async function(subscriberId) {
        await storage.del(subscriberId)
        log.dim.blue(subscriberId, 'has been removed')
    },
    getSubscribers: async function () {
        return await storage.keys()
    }
};
