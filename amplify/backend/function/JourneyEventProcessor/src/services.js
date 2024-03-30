const AWS = require('aws-sdk');
var glue = new AWS.Glue();
const { TableNames } = require('@commonutils/constants');
const { SecretKeys } = require('@commonutils/secretManager');
const { ElasticIndices } = require('@searchutils/models');

const processNewCampaign = async function (event) {
    console.log("In processNewCampaign()");


    var jobParams = {
        JobName: 'BerryCampaignPingProcessor',
        Arguments: {
            '--additional-python-modules': 'elasticsearch==7.10',
            '--orgId': event.orgId,
            '--eventType': event.eventType,
            '--workflowId': event.workflowId,
            '--parentWorkflowId' : event.parentWorkflowId,
            '--workflowTable': TableNames.WORKFLOW,
            '--conversationTable': TableNames.CONVERSATIONS,
            '--pingTable': TableNames.PING,
            '--elasticSecretName': SecretKeys.ELASTIC_CONFIG,
            '--employeeIndex': ElasticIndices.employees,
            '--stepIndex': ElasticIndices.step,
            '--workflowIndex' : ElasticIndices.workflows
        }
    };
  
    var glueResponse = await glue.startJobRun(jobParams).promise();
    console.log("glue response-", glueResponse);

};


module.exports = {
    processNewCampaign
};