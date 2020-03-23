const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { typeDefs } = require('./graphql/schema') //graphql schema
const Query = require('./resolvers/queries/index'); //getting Queries resolvers of graphql
const Mutation = require('./resolvers/mutations/index'); //getting Queries resolvers of graphql
const {port} = require('./config/key');
const db = require('./config/database')

db.sync()
  .then(() => console.log('Database connected...'))
  .catch(err => console.log('Error: ' + err))

 
// Provide resolver functions for your schema fields
const resolvers = {
  Query,
  Mutation
};
 
const server = new ApolloServer({ typeDefs, resolvers });
 
const app = express();
server.applyMiddleware({ app });
 
app.listen({ port }, () =>
  console.log(`🚀 Server ready at http://localhost:${port}${server.graphqlPath}`)
);