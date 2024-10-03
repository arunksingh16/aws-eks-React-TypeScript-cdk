import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export interface EKSControllerProps extends cdk.StackProps {
    cluster: eks.Cluster;
    kubectlLambaRole: iam.Role;
}


export class EKSController extends cdk.Stack {

    constructor(scope: Construct, id: string, props: EKSControllerProps) {
        super(scope, id, props);

        const cluster = eks.Cluster.fromClusterAttributes(this, 'eks-cluster', {
            clusterName: 'eks-cluster',
            openIdConnectProvider: eks.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'OIDCProvider', 'arn:aws:iam::<AWS_Account>:oidc-provider/oidc.eks.eu-central-1.amazonaws.com/id/<ID>'),
            kubectlRoleArn: props.kubectlLambaRole.roleArn,
          });

        // https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
        const policyJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../my-react-app/deployments/iam_policy.json'), 'utf8'));
        const albPolicy = iam.PolicyDocument.fromJson(policyJson);
        const albServiceAccount = cluster.addServiceAccount('aws-load-balancer-controller', {
            name: 'aws-load-balancer-controller',
            namespace: 'kube-system',
          });
          
          albServiceAccount.role.attachInlinePolicy(new iam.Policy(this, 'ALBControllerPolicy', {
            document: albPolicy
          }));


          cluster.addHelmChart('ALBController', {
            chart: 'aws-load-balancer-controller',
            release: 'aws-load-balancer-controller',
            repository: 'https://aws.github.io/eks-charts',
            namespace: 'kube-system',
            values: {
              clusterName: cluster.clusterName,
              serviceAccount: {
                create: false,
                name: albServiceAccount.serviceAccountName
              },
            },
          });

          const backendSvcAccount = cluster.addServiceAccount('backendSvcAccount', {
            name: 'be-svc-account',
            namespace: 'default',
          });

          backendSvcAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'));
          backendSvcAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'));
          backendSvcAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRDSReadOnlyAccess'));

    }
}