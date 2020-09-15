// credentials
let username = '';
let password = '';

/**
 * Set credentials for plugin
 *
 * @param string username | email
 * @param string password | password
 * @return void
 */
const setCredentials = (u, p) => {
  username = u;
  password = p;
};

/**
 * Get authentication
 *
 * @return string | xml authentication block
 */
const authentication = () => `<Authentication>
                <UserName>${username}</UserName>
                <Password>${password}</Password>
                              </Authentication>`;

module.exports = {
  authentication,
  setCredentials,
};
