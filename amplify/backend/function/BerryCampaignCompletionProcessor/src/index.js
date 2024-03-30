/* Amplify Params - DO NOT EDIT
	ENV
	REGION
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
const utilityFunctions = require('./utility-function');
const { listAllOrgDetails } = require('@dbutils/orgEntity');

exports.handler = async (event) => {

    const allOrgIds = await listAllOrgDetails(["orgId"]); //getting all org Ids from the table
    for(const orgObj of allOrgIds){
        let campaignData = await utilityFunctions.getWorkflowList(orgObj.orgId);
        if(campaignData && campaignData.data && campaignData.data.items && campaignData.data.items.length>0){

            campaignData = campaignData.data.items;
           
            //date check for all campaigns in the array, only keep the ones that we need to mark 'Complete'
            campaignData = await utilityFunctions.campaignDateCheck(campaignData);
            console.log("Campaigns to remove from users list: ",campaignData);

        }
    }
};