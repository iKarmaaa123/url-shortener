<h1>URL-Shortener-project</h1>

<h2> Overview </h2>

This project involves deploying a url-shortener service that allows users to shorten any url of their choosing. The following tech stack was used for this project: AWS, AWS CDK, Docker, Python, Go, and GitHub Actions. 

This README serves as a guide to help you to provision the infrastructure for the url-shortener service. This README will also outline various best practices that were used throughout the project and will include decisions made with the trade-offs.

<h2> Architectural diagram of the project </h2>

Below is the architectural diagram of the infrastructure that we are going to be setting up in this project:


<h2> Directory Structure </h2>

Below is an overview of what this directory structure will look like for this project:

```hcl
.
|-- README.md
|-- docker-compose.yaml
|-- infra
|   |-- -apporove
|   |   |-- asset.7fa1e366ee8a9ded01fc355f704cff92bfd179574e6f9cfee800a3541df1b200
|   |   |   |-- __entrypoint__.js
|   |   |   `-- index.js
|   |   |-- cdk.out
|   |   |-- ecrStack.assets.json
|   |   |-- ecrStack.template.json
|   |   |-- ecsStack.assets.json
|   |   |-- ecsStack.template.json
|   |   |-- manifest.json
|   |   `-- tree.json
|   |-- bin
|   |   `-- ecs-project-v2.ts
|   |-- cdk.json
|   |-- cdk.out
|   |   |-- asset.7fa1e366ee8a9ded01fc355f704cff92bfd179574e6f9cfee800a3541df1b200
|   |   |   |-- __entrypoint__.js
|   |   |   `-- index.js
|   |   |-- cdk.out
|   |   |-- dynamoDBStack.assets.json
|   |   |-- dynamoDBStack.template.json
|   |   |-- ecrStack.assets.json
|   |   |-- ecrStack.metadata.json
|   |   |-- ecrStack.template.json
|   |   |-- ecsStack.assets.json
|   |   |-- ecsStack.metadata.json
|   |   |-- ecsStack.template.json
|   |   |-- id.assets.json
|   |   |-- id.template.json
|   |   |-- manifest.json
|   |   |-- tree.json
|   |   |-- vpcStack.assets.json
|   |   `-- vpcStack.template.json
|   |-- jest.config.js
|   |-- lib
|   |   |-- config
|   |   |   |-- app-constants.ts
|   |   |   `-- app-settings.ts
|   |   |-- ecr-stack.ts
|   |   |-- ecs-stack.ts
|   |   `-- modules
|   |       |-- alb-construct.ts
|   |       |-- codedeploy-construct.ts
|   |       |-- dynamodb-construct.ts
|   |       |-- ecr-construct.ts
|   |       |-- ecs-construct.ts
|   |       |-- elasticacheredis-construct.ts
|   |       |-- iam-construct.ts
|   |       |-- postgresql-construct.ts
|   |       |-- sqs-construct.ts
|   |       |-- vpc-construct.ts
|   |       `-- waf-construct.ts
|   |-- package-lock.json
|   |-- package.json
|   |-- test
|   |   `-- ecs-project-v2.test.ts
|   `-- tsconfig.json
`-- services
    |-- api
    |   |-- Dockerfile
    |   |-- requirements.txt
    |   |-- src
    |   |   |-- db.py
    |   |   |-- events.py
    |   |   `-- main.py
    |   `-- tests
    |       |-- test_api.py
    |       `-- test_ddb.py
    |-- dashboard
    |   |-- Dockerfile
    |   |-- go.mod
    |   `-- main.go
    `-- worker
        |-- Dockerfile
        |-- go.mod
        `-- main.go
```

<h2> Prerequisites </h2>

🛠 In order to follow this project you will need to have the following installed:

- ✅ An AWS Account with an IAM user (do not use the root account) - [Create An Account Here](https://aws.amazon.com/free/?trk=ce1f55b8-6da8-4aa2-af36-3f11e9a449ae&sc_channel=ps&ef_id=Cj0KCQjw782_BhDjARIsABTv_JCWZitQyH0tU_lYElDDQ9HdBabDxB-tKSgYDsRiU0N_XqiVVpjvBTUaAmR7EALw_wcB:G:s&s_kwcid=AL!4422!3!433803621002!e!!g!!aws%20sign%20up!9762827897!98496538743&gclid=Cj0KCQjw782_BhDjARIsABTv_JCWZitQyH0tU_lYElDDQ9HdBabDxB-tKSgYDsRiU0N_XqiVVpjvBTUaAmR7EALw_wcB&all-free-tier.sort-by=item.additionalFields.SortRank&all-free-tier.sort-order=asc&awsf.Free%20Tier%20Types=*all&awsf.Free%20Tier%20Categories=*all)

- ✅ Docker - [Download & Install](https://www.docker.com/get-started/)

- ✅ Node.js & npm - [Download & Install](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

- ✅ Typescript - [Download & Install](https://www.npmjs.com/package/typescript)

- ✅ AWS CDK - [Download & Install](https://docs.aws.amazon.com/cdk/v2/guide/getting-started.html)

<h2> Running the url-shortener service locally </h2>

If you would like to run thiss setup locally, then be sure to have certain resources running before bringing up all the container services within the docker-compose file. You will need to make sure you have the following configured:


- `POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD` environment variables all have a value configured for them in your docker-compose file
- An environment variable for your DynamoDB table set up that you are going to store the shorten urls.
- The URL of SQS queue that is going to be used for storing click events after a url redirect happens.
- Ensure you have a `.env` configured for your AWS Credentials and Region which will be used by your boto3 client when your container services are running.

Make sure the following are configured in your .env file:

AWS_ACCESS_KEY_ID="<INSERT VALUE>"
AWS_SECRET_ACCESS_KEY="<INSERT VALUE>"
AWS_DEFAULT_REGION="<INSERT VALUE>"

Once you have everything configured, go ahaed and bring up all your containerised services in your docker-compose file:

docker compose up -d
 
Run docker ps command or check Docker Desktop to ensure that all containers are running successfully.

Once everything is running




