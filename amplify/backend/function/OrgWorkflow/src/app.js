/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGSTEP_ARN
	STORAGE_ORGSTEP_NAME
	STORAGE_ORGSTEP_STREAMARN
	STORAGE_ORGWORKFLOW_ARN
	STORAGE_ORGWORKFLOW_NAME
	STORAGE_ORGWORKFLOW_STREAMARN
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
  STORAGE_ORGWORKFLOW_ARN
  STORAGE_ORGWORKFLOW_NAME
  STORAGE_ORGWORKFLOW_STREAMARN
Amplify Params - DO NOT EDIT */

var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')
const {
  deleteWorkflowFromDB
} = require('@dbutils/workflow');

const services = require('./services');
const lambdaPath = "/workflow";

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
 * Handler function to get executed Workflows from DB for a particular orgId 
 * endpoint: /workflow/:orgId/executed
 */
app.get(lambdaPath + '/:orgId/executed', async (req, res) => {

  // Retrieve path params.
  const { orgId } = req.params;

  const response = await services.getExecutedWorkflowList(orgId);

  res.statusCode = response.statusCode;
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get Workflow templates from DB for a particular orgId 
 * endpoint: /workflow/:orgId/surveytemplate
 */
app.get(lambdaPath + '/:orgId/surveytemplate', async (req, res) => {

  // Retrieve path params.
  const { orgId } = req.params;
  const { filter } = req.body;

  const response = await services.getSurveyTemplates(orgId, filter);

  res.statusCode = response.statusCode;
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get Workflow templates from DB for a particular orgId and passed filters
 * endpoint: /workflow/:orgId/search
 */
 app.post(lambdaPath + '/:orgId/search', async (req, res) => {

  // console.log("we are here: ",req.body.searchFilter);
  // Retrieve path params.
  const { orgId } = req.params;
  var filters = [];
  if(req.body.searchFilter){
      filters = req.body.searchFilter;
      // console.log("Printing incoming filters: ",JSON.stringify(filters,null,3));
  }

  const response = await services.getExecutedWorkflowList(orgId, filters);
  // var response = {};
  res.statusCode = response.statusCode;
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get Workflow from DB for a particular orgId and WorkflowId.
 * endpoint: /workflow/:orgId/workflowId/:workflowId
 */
app.get(lambdaPath + '/:orgId/workflowId/:workflowId', async (req, res) => {

  // Retrieve path params.
  const { orgId, workflowId } = req.params;
  const response = await services.fetchWorkflowForId(orgId, workflowId);

  res.json(response);

});


/**
 * Handler function to get all campaign page filters based on org.
 * endpoint: /step/:orgId/filters
 */
  app.get(lambdaPath + '/:orgId/filters', async (req, res) => {
  console.log(" /workflow/:orgId/filters ");
  // Retrieve path params.
  const { orgId } = req.params;

  const response = await services.fetchWorkflowFilters(orgId);

  //res.statusCode = response.statusCode;
  res.json(response);

});


/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to insert a Workflow for an org
 * endpoint: /workflow/:orgId
 */
app.post(lambdaPath + '/:orgId', async (req, res) => {

  // Retrieve path params.
  const { orgId } = req.params;
  const response = await services.insertWorkflow(orgId, req.body);
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to create a Workflow from a WorkflowTemplate
 * endpoint: /workflow/:orgId/copyWorkflowTemplate/:workflowTemplateId
 */
app.post(lambdaPath + '/:orgId/copyworkflowtemplate/:workflowTemplateId', async (req, res) => {

  // Retrieve path params.
  const { orgId, workflowTemplateId } = req.params;
  const { updateParams } = req.body;

  const response = await services.createWorkflowFromTemplate(orgId, workflowTemplateId, updateParams);
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to update Workflow
 * endpoint: /workflow/:orgId/workflowId/:workflowId
 */
app.put(lambdaPath + '/:orgId/workflowId/:workflowId', async (req, res) => {

  // Retrieve path params.
  const { orgId, workflowId } = req.params;

  const { updateParams } = req.body;
  // console.log("Receiver endpoint : ", updateParams.campaignStartMessages);
  const response = await services.updateWorkflow(orgId, workflowId, updateParams);
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to delete a Workflow.
 * endpoint: /workflow/:orgId/workflowId/:workflowId
 */
app.delete(lambdaPath + '/:orgId/workflowId/:workflowId', async (req, res) => {
  // Retrieve path params.
  const { orgId, workflowId } = req.params;
  await deleteWorkflowFromDB(orgId, workflowId);
});

app.listen(3000, function () {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app