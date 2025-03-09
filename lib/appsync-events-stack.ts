import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Duration } from 'aws-cdk-lib';

export class AppsyncEventsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // AppSync API
    const eventsApi = new appsync.EventApi(this, 'AppsyncEventsApi', {
      apiName: 'AppsyncEventsApi',
    });

    eventsApi.addChannelNamespace('default');

    // REST API
    const restApi = new apigateway.RestApi(this, 'AppsyncEventsRestApi', {
      restApiName: 'AppsyncEventsRestApi',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [...apigateway.Cors.DEFAULT_HEADERS, 'X-Amz-Invocation-Type'],
      }
    });

    const root = restApi.root.addResource('trigger');

    const lambda = new NodejsFunction(this, 'AppsyncEventsLambda', {
      entry: path.join(__dirname, '..', 'lambda', 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_LATEST,
      timeout: Duration.minutes(5),
    });

    lambda.addPermission('ApiGatewayInvokePermission', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: restApi.arnForExecuteApi(),
    });

    const apiGatewayRole = new iam.Role(this, 'ApiGatewayLambdaRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    
    apiGatewayRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [lambda.functionArn],
        effect: iam.Effect.ALLOW,
      })
    );

    const integration = new apigateway.AwsIntegration({
      service: 'lambda',
      path: `2015-03-31/functions/${lambda.functionArn}/invocations`,
      integrationHttpMethod: 'POST',
      options: {
        credentialsRole: apiGatewayRole,
        requestParameters: {
          'integration.request.header.X-Amz-Invocation-Type': "'Event'",
        },
        requestTemplates: {
          'application/json': JSON.stringify({
            FunctionName: lambda.functionName,
            InvocationType: 'Event',
            Payload: '$util.escapeJavaScript($input.body)',
          }),
        },
        integrationResponses: [{ statusCode: '202' }],
      }
    });

    root.addMethod('POST', integration, {
      methodResponses: [{ statusCode: '202' }]
    });

    lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:*'],
        resources: ['*'],
      })
    );
  }
}
