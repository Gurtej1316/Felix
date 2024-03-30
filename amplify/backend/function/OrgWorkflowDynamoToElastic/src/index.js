/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGWORKFLOW_ARN
	STORAGE_ORGWORKFLOW_NAME
	STORAGE_ORGWORKFLOW_STREAMARN
Amplify Params - DO NOT EDIT */
const axios = require('axios');
const AWS = require('aws-sdk');

// DynamoDB Configurations
const orgIdName = 'orgId';
const recordIdName = 'workflowId';
const {ElasticClusterConfig, ElasticIndices,ElasticIndexTypes} = require('@searchutils/models');

exports.handler = async (event, context) => {
    const ElasticClusterConfigData= await ElasticClusterConfig;

    const url = `${ElasticClusterConfigData.node}/${ElasticIndices.workflows}/_doc/`;

    let count = 0;
    for (const record of event.Records) {
        const id = encodeURIComponent(record.dynamodb.Keys[orgIdName].S+"-"+record.dynamodb.Keys[recordIdName].S);
        try {
            if (record.eventName == 'REMOVE') {
                await axios.delete(url + id, { auth: ElasticClusterConfigData.auth });
                return 'Item removed'
            }
            else {
                const document = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
                console.log('Adding document');
                console.log(document)
                let a = await axios.put(url + id, document, { auth: ElasticClusterConfigData.auth })
                console.log(a);
            }
        } catch (error) {
            console.error(error);
            console.log('Failed to update a record in Elastic');
            console.log('Continuing with other records');
        }
        count += 1;
    }
    return `Successfully processed ${count} records.`;
};