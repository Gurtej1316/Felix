/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGROLEPERMISSIONS_ARN
	STORAGE_ORGROLEPERMISSIONS_NAME
	STORAGE_ORGROLEPERMISSIONS_STREAMARN
	STORAGE_ORGSTEP_ARN
	STORAGE_ORGSTEP_NAME
	STORAGE_ORGSTEP_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORGWORKFLOW_ARN
	STORAGE_ORGWORKFLOW_NAME
	STORAGE_ORGWORKFLOW_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */
/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/

const AWS = require('aws-sdk')
let awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
let bodyParser = require('body-parser');
let express = require('express');
AWS.config.update({ region: 'us-east-1' });
const services = require('./services');
const nocache = require('nocache');
const path = "/slackAuth";
 
let app = express();
app.use(bodyParser.json());
app.use(awsServerlessExpressMiddleware.eventContext());
app.use(nocache());
app.set('etag', false);

// Enable CORS for all methods
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});


app.put(path + '/login', async function (request, res) {
  console.log("request inside login call-", request)
  const { code, redirectURI, clientSlackID } = request.body;

  let userProfile = await services.fetchUserProfile(code, redirectURI, clientSlackID);
  res.json(userProfile);

});

app.put(path + '/install', async function (request, res) {
  console.log("inside slack install call", request.body);
  const { code, redirectURI, clientSlackID } = request.body;
  const response = await services.updateOrgDetails(code, redirectURI, clientSlackID);
  res.json(response);
});

app.listen(3000, function () {
  console.log("App started")
});


// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
