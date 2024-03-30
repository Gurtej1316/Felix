const axios = require('axios');
const AWS = require('aws-sdk');

// DynamoDB Configurations
const orgIdName = 'orgId';
const recordIdName = 'patternId';

const {ElasticClusterConfig, ElasticIndices,ElasticIndexTypes} = require('@searchutils/models');

const headers = { "Content-Type": "application/json" }

exports.handler = async (event, context) => {
    const ElasticClusterConfigData= await ElasticClusterConfig;

    const url = `${ElasticClusterConfigData.node}/${ElasticIndices.patterns}/${ElasticIndexTypes.patterns}/`;

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
                console.log(document);
                let a = await axios.put(url + id, document, { auth: ElasticClusterConfigData.auth })
                console.log('logging response after put call',a);
            }
        } catch (error) {
            console.error(error);
            console.log(JSON.stringify(error.data))
            console.log('Failed to update a record in Elastic');
            console.log('Continuing with other records');
        }
        count += 1;
    }
    return `Successfully processed ${count} records.`;
};