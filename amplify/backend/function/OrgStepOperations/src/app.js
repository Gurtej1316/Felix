/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGSTEP_ARN
	STORAGE_ORGSTEP_NAME
	STORAGE_ORGSTEP_STREAMARN
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

/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGSTEP_ARN
	STORAGE_ORGSTEP_NAME
	STORAGE_ORGSTEP_STREAMARN
Amplify Params - DO NOT EDIT */

var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')
const services = require('./services');
const {getFilteredSteps} = require('@searchutils/steps');
const {
  ResponseFormatter, ERRORS
} = require('@commonutils/formatter');

const lambdaPath = "/step";
// declare a new express app
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});


/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get Steps from DB for a particular orgId and workflowId.
 * endpoint: /step/:orgId/workflow/:workflowId
 */
app.get(lambdaPath + '/:orgId/workflow/:workflowId', async (req, res) => {

  // Retrieve path params.
  const { orgId, workflowId } = req.params;
 const response = await services.fetchStepsForWorkflow(orgId, workflowId);

  res.statusCode = response.statusCode;
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get Steps from DB for a particular orgId and workflowId.
 * endpoint: /step/:orgId/stepId/:stepId
 */
app.get(lambdaPath + '/:orgId/stepId/:stepId', async (req, res) => {

  // Retrieve path params.
  const { orgId, stepId } = req.params;

  const response = await services.fetchStepForId(orgId, stepId);

  res.statusCode = response.statusCode;
  res.json(response);

});
/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get steps from DB/elastic for a particular orgId 
 * endpoint: /step/:orgId
 */
 app.get(lambdaPath + '/:orgId', async (req, res) => {
  
  console.debug(" Inside /step/:orgId");
  // Retrieve path params.
  const { orgId } = req.params;
  //const { queryStringParameters } = req.body;
  //const { filters } = req.body;
  var filters = req.apiGateway.event["queryStringParameters"];
  console.debug(" /step/:orgId filters "+JSON.stringify(filters));
  const response = await services.fetchStepsForOrg(orgId, filters);

  res.statusCode = response.statusCode;
  res.json(response);

});
/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get Steps from DB for a particular orgId and previousStepId.
 * endpoint: /step/:orgId/previousStepId/:previousStepId
 */
 app.get(lambdaPath + '/:orgId/previousStepId/:previousStepId', async (req, res) => {
  // Retrieve path params.
  const { orgId, previousStepId } = req.params;
  const response = await services.fetchStepForpreviousId(orgId, previousStepId);
  res.statusCode = response.statusCode;
  res.json(response);
});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to insert a step correspoding to a Workflow
 * endpoint: /step/:orgId/workflow/:workflowId
 */
app.post(lambdaPath + '/:orgId/workflow/:workflowId', async (req, res) => {

  // Retrieve path params.
  console.debug('calling insertStepToWorkflow workflow/:workflowId ');
  const { orgId, workflowId } = req.params;
  const { questionText, category,momentId, moment,tags, sequence, options, sentiment, previousStepId, nextStepId,isDeleted,createdBy,isSentimentCaptured } = req.body;
  const response = await services.insertStepToWorkflow(orgId, workflowId, category, questionText,momentId, moment,tags, sequence, options, sentiment, previousStepId, nextStepId,isDeleted,createdBy,isSentimentCaptured);
 res.statusCode = response.statusCode;
  res.json(response);

});
/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to insert a step 
 * endpoint: /step/:orgId/
 */
 app.post(lambdaPath + '/:orgId', async (req, res) => {
     
  console.log("Step post , Request params - " , JSON.stringify(req.body));
  const { orgId, questionText, category,momentId,moment, sequence,tags, options, sentiment, previousStepId, nextStepId,isDeleted,createdBy,isSentimentCaptured} = req.body;
  let searchCond = await services.getSearchCondition(req.body);
  let stepResponse;
  if(category == "BankQuestion"){
    stepResponse =   await getFilteredSteps(orgId, searchCond);
  }
  let response;
  if (stepResponse.length >= 1) {
      console.log("fetchStepForpreviousId, response : "+ JSON.stringify(stepResponse));// if stepResponse exist , we have duplicate record.
      response = ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
  }else{
    console.debug('calling insertStepToWorkflow ',orgId,' - ', questionText,' - ', category,' - ',momentId,' - ',moment,' - ', sequence,' - ',tags,' - ', options,' - ', sentiment,' - ', previousStepId,' - ', nextStepId,isDeleted,createdBy);
    response = await services.insertStepToWorkflow(orgId, null, category, questionText,momentId, moment,tags, sequence, options, sentiment, previousStepId, nextStepId,isDeleted,createdBy,isSentimentCaptured);
    
  }
  res.statusCode = response.statusCode;
  res.json(response);

});
/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to update  a step correspoding to a Workflow
 * endpoint: /step/:orgId/stepId/:stepId
 */
app.put(lambdaPath + '/:orgId/stepId/:stepId', async (req, res) => {
  console.log("Inside /:orgId/stepId/:stepId : ");
  // Retrieve path params.
  const { orgId, stepId } = req.params;
  const  updateParams  = req.body;
  console.debug(updateParams);
  const response = await services.updateStepToWorkflow(orgId, stepId, updateParams);
  res.statusCode = response.statusCode;
  res.json(response);
});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to bulk update Steps. This would be used especially 
 * in scenario where step is moved up or down or added between and hence
 * two or three Steps might get impacted
 * endpoint: /step/:orgId/bulk
 */
app.put(lambdaPath + '/:orgId/bulk', async (req, res) => {

   // Retrieve path params.
   const { orgId } = req.params;
   const response = await services.updateInsertStepInBulk(orgId, req.body);
   res.statusCode = response.statusCode;
   res.json(response); 

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to delete a step.
 * endpoint: /step/:orgId/stepId/:stepId
 */
app.delete(lambdaPath + '/:orgId/workflow/:workflowId', async (req, res) => {
  // Retrieve path params.
  const { orgId, workflowId } = req.params;
  console.debug("orgId ",orgId," workflowId", workflowId);
  const response = await services.deleteStepsFromWorkflow(orgId, workflowId);
  res.statusCode = response.statusCode;
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to delete a step.
 * endpoint: /step/:orgId/stepId/:stepId
 */
 app.delete(lambdaPath + '/:orgId/stepId/:stepId', async (req, res) => {
  // Retrieve path params.
  const { orgId, stepId } = req.params;

  const response = await services.deleteStep(orgId, stepId);
  res.statusCode = response.statusCode;
  res.json(response);

});

/**
 * Handler function to get all questions page filters based on org.
 * endpoint: /step/:orgId/filters
 */
 app.get(lambdaPath + '/:orgId/filters', async (req, res) => {
  console.log(" /step/:orgId/filters ");
  // Retrieve path params.
  const { orgId } = req.params;

  const response = await services.fetchQuestionFilters(orgId);

  //res.statusCode = response.statusCode;
  res.json(response);

});

app.listen(3000, function () {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
