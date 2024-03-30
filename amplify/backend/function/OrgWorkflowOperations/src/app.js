/* Amplify Params - DO NOT EDIT
	ENV
	REGION
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
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const bodyParser = require('body-parser')
const express = require('express')
const { searchService } = require('./orgWorkflowServices');
const { pickObjectProperty } = require("@commonutils/pick");

AWS.config.update({ region: process.env.TABLE_REGION });

const path = "/workflows";

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});


/**
 * Handler function to search workflows data.
 * endpoint: /workflows/:orgId/search
 */
 app.post(path + '/:orgId/search', async (req, res) => {
  const searchOptions = pickObjectProperty(req.body, [ "offset", "limit", "sortBy", "sortOrder", "filters", "mustNotFilters" ]);
  // Retrieve path params.
  const { orgId } = req.params;

  const response = await searchService.getSearchResults(orgId, searchOptions);
  res.json(response);

});


/**
 * Handler function to get unique column values.
 * endpoint: /workflows/:orgId/unique
 */
app.post(path + '/:orgId/unique', async (req, res) => {
  const properties = req.body.properties;
  const filters = await searchService.getPropertyUniqueValues(req.params.orgId, properties);
  const statusFilter = filters?.find(item => item.property === "status") ?? undefined;
  if(statusFilter){
    statusFilter.uniqueValues.splice(statusFilter.uniqueValues.indexOf('Active'),1);
    filters['status'] = statusFilter;
  }
  res.json(filters); 
});


app.listen(3000, function() {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app;