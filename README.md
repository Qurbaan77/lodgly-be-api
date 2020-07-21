## Setup

* Copy the environment skeleton `cp .env.dist .env`
* Replace the values with your configuration in `.env`
* `npm install`

## Run

Prerequisite - You must get the `local-development.js` file and put it to `config` folder. Ask for it.

On host: `npm run dev`

In docker: `docker-compose up`

## Troubleshoots

If you have a problem with setup the application with docker please follow the steps below:

* Remove `node_modules` directory
* Cleanup docker data:

```
# prune docker data
docker system prune -a

# stop all containers
docker kill $(docker ps -q)

# remove all containers
docker rm $(docker ps -a -q)

# remove all docker images
docker rmi $(docker images -q)
```

* Build docker images: `docker-compose up --build`


## Structure

[/src](/src)

This is where the main app lives. All files related to the code base of the application should live in here to simplify the extraction of the app (e.g. containerizing).

[/config](/config)

This folder includes all the config parts for the app. Every stage has its own config file and can override the default. Config values based on the environment or secrets should be referenced as environment variables.

[/src/models](/src/models)

This is a wrapper around getting and saving the data required for the business. Generally, also most of the business logic should be represented here. If possible, organize the logic according to the REST resources.

[/src/services](/src/services)

This folder includes mostly adapter functions about common functionality used in the app (e.g. reading and writing files, getting data from a third party service, logging).

## Hooks

During `npm install`, the `husky` package will enable the following hooks:

* Check for linting before each commit

## Contribute

1. Make your code changes
2. Update the version according to semantic versioning in [/VERSION](/VERSION)
3. Update the swagger docs if you made any changes to the API in [/swagger.yml](/swagger.yml)
