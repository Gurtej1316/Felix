const {
    getSearchQuery, getUniqueValuesQuery,
    getUniqueValuesFromResponse
  } = require("@commonutils/search");
  const { Entities } = require("@commonmodels/elastic");
  const { GetElasticClient, ElasticIndices, getElasticHits } = require('@searchutils/models');
  
  /**
   * Service function which holds business logic to fetch unique values of each employees  schema fields.
   */
  const getPropertyUniqueValues = async (orgId, properties) => {
    const aggregateQuery = getUniqueValuesQuery(Entities.employees, properties);
    console.log(aggregateQuery);
    const elasticClient = await GetElasticClient();
    const elasticResponse = await elasticClient.search({
      index: ElasticIndices.employees,
      body: {
        query: {
          "bool": {
            "must": [{
              "match": {
                "orgId.keyword": orgId
              }
            }]
          }
        },
        aggs: aggregateQuery
      }
    });
    return getUniqueValuesFromResponse(elasticResponse, properties);
  };
  
  /**
   * Service function which holds business logic to fetch paginated and filtered employees  data.
   * @param {*} options
   * @returns
   */
  const getSearchResults = async (options) => {
    const searchQuery = getSearchQuery(Entities.employees, options);
    searchQuery.size = 10;
    console.log('search query - ',JSON.stringify(searchQuery));
    const elasticClient =await GetElasticClient();
    const elasticResponse = await elasticClient.search({
      index: ElasticIndices.employees,
      body: searchQuery
    });
    console.log("elasticResponse - ", getElasticHits(elasticResponse));
    return getElasticHits(elasticResponse);
  };
  
  module.exports = {
    getPropertyUniqueValues,
    getSearchResults
  };