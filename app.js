const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { typeDefs } = require('./graphql/schema') //graphql schema
const Query = require('./resolvers/queries/index'); //getting Queries resolvers of graphql
const Mutation = require('./resolvers/mutations/index'); //getting Queries resolvers of graphql
const {port} = require('./config/key');
const db = require('./config/database')
const { shield } = require('graphql-shield') //for authorization in graphql
const { makeExecutableSchema } = require('graphql-tools') //for making make executable schema
const { applyMiddleware } = require('graphql-middleware') //for applying middleware
const { isAuthenticated } = require('./graphql/authorizer'); //getting athorizer function




db.sync()
  .then(() => console.log('Database connected...'))
  .catch(err => console.log('Error: ' + err))

 
// Provide resolver functions for your schema fields
const resolvers = {
  Query,
  Mutation
};

const permissions = shield({
  "Query": {
    validateAgencyToken: isAuthenticated,
  },
  "Mutation": {
      
  }   
})

const schema = applyMiddleware(
  makeExecutableSchema({
      typeDefs,
      resolvers,
  }),
  permissions,
)
 
const server = new ApolloServer({ typeDefs, resolvers });
 
const app = express();
server.applyMiddleware({ app });
 
app.listen({ port }, () =>
  console.log(`🚀 Server ready at http://localhost:${port}${server.graphqlPath}`)
);