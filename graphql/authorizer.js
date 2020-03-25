const { rule } = require('graphql-shield') //for authorization in graphql
const {verifyJwt} = require("../function")

//authorizer function
const isAuthenticated = rule()(async (parent, args, ctx, info) => {
    console.log("isAuthenticated method called: ","header :", ctx.user.event.headers)
    try {
        if (ctx.user.event.headers) { //checking if headers are present in request
            let authHeader = ctx.user.event.headers["AuthToken"] //getting AuthToken header
            if (!authHeader) {
                authHeader = ctx.user.event.headers["authToken"] //getting authToken from header
            }

            if (!authHeader) {
                return "AuthToken not found"
            }
            else if (authHeader) { //checking if both are present
                try {
                    const isValidToken = await verifyJwt(authHeader)
                    if (isValidToken) {
                        ctx.tokenData = isValidToken
                        return true;
                    } else {
                        res.send({
                            code: 400,
                            msg: 'Authentication is required'
                        })
                    }
                } catch (e) {
                    return "authToken not valid"
                }
            }
            else {
                return "AuthToken not found"
            }
        }
        else {
            return "AuthToken not found"
        }
    }
    catch (e) {
        if (e.errorInfo) { //checking if "e" argument has "errorInfo" property in it
            return e.errorInfo.message //returning "errorInfo" message
        }
        else {
            return "You are not allowed to perform this action"
        }
    }
})


//function to check if property is present in request or not
const checkRequest = (req) => {
    if (req.event.headers.valid) { //checking for "valid" property in headers
        return req //returning data
    }
    else {
        return notAuthorized //returning message
    }
}


//exporting authorizer function
module.exports = { isAuthenticated, checkRequest }