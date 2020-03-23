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
 
  type Query {
    test: Test!
    readUserData:Test!
  }

  type Mutation{
    registerAgencies(data:Registeragencies!):RegisteragenciesType!
    login(data:loginInput!): AuthPayload!
  }
`;


//exporting graphql schema
module.exports = {
  typeDefs
}

