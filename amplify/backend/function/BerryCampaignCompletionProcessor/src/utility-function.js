const {  ResponseFormatter, ERRORS } = require('@commonutils/formatter');
const { getExecutedWorkflowListFromSearch } = require('@searchutils/workflow');
const { updateWorkflowToDB } = require('@dbutils/workflow');
const { WorkflowStatus } = require('@commonutils/constants');

const getWorkflowList = async function (orgId) {
    try {
       let campaignFilters = [];
       let searchCond = [];
       campaignFilters.push({ term: { "status.keyword": { value: WorkflowStatus.RUNNING } } }  ); 
       searchCond.push({ bool: { should: [...campaignFilters]}});
       let options = {searchCond : searchCond};
       const response = await getExecutedWorkflowListFromSearch(orgId, options);
       return ResponseFormatter(response);
   } catch (error) {
       console.error(error);
       return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
   }
};


const campaignDateCheck = async function (campaigns) {

    for(var i=0 ; i < campaigns.length ; i++){
        let campaignObj = campaigns[i];
        let argEndDate = campaignObj.endDate;
        let todayDate = new Date();

        todayDate.setHours(0, 0, 0, 0);
        let campaignEndDateFormatted = new Date(argEndDate);
        campaignEndDateFormatted.setHours(0, 0, 0, 0);
        if (todayDate.getTime() - campaignEndDateFormatted.getTime() > 0) {
            let updateParams = {
                status : 'Completed'
            };
            try {
                await updateWorkflowToDB(campaignObj.orgId, campaignObj.workflowId, updateParams);
            } catch (error) {
                console.error(error);
            }
        }else{
            //not to be marked as 'Complete'
            campaigns.splice(i,1);
            i--;
        }
    }
    return campaigns;
};

module.exports = {
    campaignDateCheck,
    getWorkflowList
};