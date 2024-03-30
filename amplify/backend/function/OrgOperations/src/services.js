/**This file hosts all services for the REST Handles */
const { ResponseFormatter, ERRORS } = require('@commonutils/formatter');
var _ = require('lodash');
const { getOrgAttribute } = require('@dbutils/org');
const { getDistinctEmpAttributeValues } = require('@searchutils/employees');

/**
 * Function to fetch Steps using WorkflowIg
 * @param {*} orgId 
 * @returns 
 */
const fetchGlobalFilters = async function (orgId) {

    try {
        const getParams = 'employeeAttributeMapping';
        const response = await getOrgAttribute(orgId, getParams);
        let returnArray = [];
        let promiseArray = [];
        let arrayIndex = 0;

        if (response.Item && response.Item.employeeAttributeMapping) {

            for (const index in response.Item.employeeAttributeMapping)
            {
                if(response.Item.employeeAttributeMapping[index].globalFilter)
                {
                   returnArray[arrayIndex] = response.Item.employeeAttributeMapping[index];
                   promiseArray[arrayIndex] =  getDistinctEmpAttributeValues(orgId,returnArray[arrayIndex].key);
                   arrayIndex++;
                }   
            }
            
            const uniqueValuesArray = await Promise.all(promiseArray);

            for (const index in returnArray)
            {
                delete returnArray[index].globalFilter;
                returnArray[index].uniqueValues = _.compact(uniqueValuesArray[index].map(item => item[returnArray[index].key]));
            }

            return ResponseFormatter(returnArray);
        }
        //returning blank list if no org level attribute set for "employeeAttributeMapping"
        return ResponseFormatter(returnArray);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

};




module.exports = {
    fetchGlobalFilters
}