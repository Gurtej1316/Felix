/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/


/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGINSIGHTS_ARN
	STORAGE_ORGINSIGHTS_NAME
	STORAGE_ORGINSIGHTS_STREAMARN
Amplify Params - DO NOT EDIT */

var express = require('express')
var bodyParser = require('body-parser')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const { searchService, aggregateService, exportService } = require('./insightServices');
const { pickObjectProperty } = require("@commonutils/pick");

// declare a new express app
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

const path = '/insight';
// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});

/**
 * Handler function to search insights data.
 * endpoint: /insight/:orgId/search
 */
app.post(path + '/:orgId/search', async (req, res) => {
 const searchOptions = pickObjectProperty(req.body, [ "offset", "limit", "sortBy", "sortOrder", "filters", "mustNotFilters" ]);
 const periodFilter = req.body.periodFilter;
 const aggregateOptions = req.body.aggregations;
 console.log("searchOptions : " , JSON.stringify(searchOptions) , "periodFilter : ", JSON.stringify(periodFilter) , "aggregateOptions : " , JSON.stringify(aggregateOptions));

 let result = {};
 if(aggregateOptions){
   const response = await aggregateService.getAggregatedResults(req.params.orgId, searchOptions, periodFilter, aggregateOptions);
   result['data'] = Object.values(response);
 }
 else{
   result = await searchService.getSearchResults(req.params.orgId, searchOptions, periodFilter);
 }
 res.json(result); 
});

/**
* Handler function to get unique column values.
* endpoint: /insight/:orgId/unique
*/
app.post(path + '/:orgId/unique', async (req, res) => {
 const properties = req.body.properties;
 const filters = await searchService.getPropertyUniqueValues(req.params.orgId, properties);
 res.json(filters); 
});

/**
 * Handler function to fetch aggregate of insight data.
 * endpoint: /insight/:orgId/aggregate
 */
 app.post(path + '/:orgId/aggregate', async (req, res) => {
  const filterOptions = pickObjectProperty(req.body, [ "filters" ]);
  const periodFilter = req.body.periodFilter;
  const aggregateOptions = req.body.aggregations;
  let result = await aggregateService.getAggregatedResults(
    req.params.orgId, filterOptions, periodFilter, aggregateOptions
  );
  console.log(result);
  res.json(result);
});

/**
 * Handler function to export insight data.
 * endpoint: /insight/:orgId/export
 */
app.post(path + '/:orgId/export', async (req, res) => {
  const searchOptions = pickObjectProperty(req.body, [ "sortBy", "sortOrder", "filters" ]);
  const responseType = req.body.responseType;
  const result = await exportService.getExportResults(req.params.orgId, searchOptions);
  const fileKey = await exportService.getExportS3FileKey(req.params.orgId, result.data, responseType);
  res.send({
    key: fileKey,
  });
});


app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
