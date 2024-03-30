/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGROLEPERMISSIONS_ARN
	STORAGE_ORGROLEPERMISSIONS_NAME
	STORAGE_ORGROLEPERMISSIONS_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT *//*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/



const AWS = require('aws-sdk')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')

AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();

let tableName = "Org";
if(process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

const authService = require("./services");
const path = "/auth";
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});

// convert url string param to expected Type
const convertUrlType = (param, type) => {
  switch(type) {
    case "N":
      return Number.parseInt(param);
    default:
      return param;
  }
}

/**
 * Express API handle to fetch org details.
 * Path: /auth/orgIdentifier
 */
 app.put(path+'/orgIdentifier', async function(req, res) {
  console.log(req.body);
  let response;
  if(req.body.orgIdentifier){
  const orgIdentifier  = req.body.orgIdentifier;
  response = await authService.fetchOrgDetails(orgIdentifier);
  res.statusCode = response.statusCode;
  }
  res.json(response);

});

/**
 * Express API handle to fetch org details.
 * Path: /auth/orgIdentifier
 */
 app.get(path+'/user', async function(req, res) {
  let response;
  const { email } = req.query;
  response = await authService.fetchUserData(email);
  res.statusCode = response.statusCode;
  res.json(response);
});

app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
