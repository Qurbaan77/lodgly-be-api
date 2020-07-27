module.exports = {
  apps: [{
    name: 'lodgly-mvp-api',
    script: 'npm start',
    watch: ['./'],
    watch_ignore: ['node_modules', 'public'],
    watch_options: {
      followSymlinks: false,
    },
  }],
  deploy: {
    staging: {
      user: 'ubuntu',
      host: '3.249.70.45',
      ref: 'origin/staging',
      repo: 'git@gitlab.com:lodgly/lodgly-be-api.git',
      path: '/var/www/lodgly-mvp-api',
      ssh_options: 'StrictHostKeyChecking=no',
      env: {
        NODE_ENV: 'staging',
      },
      'post-deploy': [
        'npm ci --only production',
        'ln -sf /var/www/lodgly-mvp-api/shared/.env /var/www/lodgly-mvp-api/current/.env',
        'npm run knex -- migrate:latest',
        'pm2 startOrRestart /var/www/ecosystem.config.js --name lodgly-mvp-api',
      ].join(' && '),
    },
  },
};
