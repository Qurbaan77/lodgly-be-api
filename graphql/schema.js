const { gql } = require('apollo-server-express');

const typeDefs = gql`
type Test {
    message:String!
}
  type Query {
    test: Test!
  }
`;


//exporting graphql schema
module.exports = {
  typeDefs
}

