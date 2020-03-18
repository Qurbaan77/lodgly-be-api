'use strict';

const test = (parent, args, context) => {
    console.log('herer')
    return { message: "test message" }
};

module.exports = {
    test
};