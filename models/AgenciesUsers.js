const Sequelize = require('sequelize');
const db = require('../config/database');

const AgenciesUsers = db.define('agencies_user',{

    email:{
        type:Sequelize.STRING,
        isEmail:true,
        required:true
    },
    username:{
        type:Sequelize.STRING
    },
    password:{
        type:Sequelize.STRING
    },
    mob:{
        type:Sequelize.STRING
    },
    package:{
        type:Sequelize.STRING
    },
    verificationhex:{
        type:Sequelize.STRING
    }
})

module.exports = AgenciesUsers;