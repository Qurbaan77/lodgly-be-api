const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type Test {
      message:String!
  }
  input Registeragencies {
    email:String!
    username:String
    password: String
    mob: String
    package:Int
  }

  type RegisteragenciesType {
    id:String
    email:String
    username:String
    mob: String
    package:Int
  }
  
  input loginInput {
    email:String!
    password:String!
  }

  type AuthPayload {
    token: String!
  }

  type message {
    message:String!
  }
  

  input forgetPasswordInput {
    newpassword:String,
    hax:String
  }
 
  type Query {
    test: Test!
    readUserData:Test!
    validateAgencyToken:RegisteragenciesType!
  }

  type Mutation{
    registerAgencies(data:Registeragencies!):RegisteragenciesType!
    verifyUser(hex:String!):message!
    login(data:loginInput!): AuthPayload!
    forgetPassword(data:forgetPasswordInput!):message!
    resetPassword(email:String!):message!
  }
`;


//exporting graphql schema
module.exports = {
  typeDefs
}

