import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV30Layer } from '@aws-cdk/lambda-layer-kubectl-v30'

interface EksStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  ekssecgrp: ec2.SecurityGroup;
  role: iam.Role;
}

export class EKSStack extends cdk.Stack {
  // public read-only properties are defined using the readonly keyword. They allow you to expose the values of instance fields to external code without allowing direct modification. 
  // This provides a controlled way to access and use the data within the class. This property will hold a reference to the EKS cluster that will be created within this stack.
  public readonly cluster: eks.Cluster;
  constructor(scope: Construct, id: string, props:EksStackProps) {
    super(scope, id, props);
    // Create the EKS Cluster
    this.cluster = new eks.Cluster(this, 'EKSCluster', {
      clusterName: 'eks-cluster',
      vpc: props.vpc,
      defaultCapacity: 0, // number of nodes
      ipFamily: eks.IpFamily.IP_V4,
      version: eks.KubernetesVersion.V1_30,
      outputClusterName: true,
      outputConfigCommand: true,
      securityGroup: props.ekssecgrp,
      authenticationMode: eks.AuthenticationMode.API,
    // The kubectl handler uses kubectl, helm and the aws CLI in order to interact with the cluster. These are bundled into AWS Lambda layers included in the @aws-cdk/lambda-layer-awscli and @aws-cdk/lambda-layer-kubectl modules.
      kubectlLayer: new KubectlV30Layer(this, 'kubectl'),
      kubectlMemory: cdk.Size.gibibytes(4),
    });

    // Cluster Admin role for this cluster
    this.cluster.grantAccess('clusterAdminAccess', props.role.roleArn, [
      eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
        accessScopeType: eks.AccessScopeType.CLUSTER,
      }),
    ]);

    const policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ecr:*'],
      resources: ['*'],
    });

    const EksClusterRole = new iam.Role(this, 'EksClusterRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSWorkerNodePolicy"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKS_CNI_Policy"),
      ],
    });
    EksClusterRole.addToPolicy(policy);
    this.cluster.addNodegroupCapacity("custom-node-group", {
      amiType: eks.NodegroupAmiType.BOTTLEROCKET_X86_64,
      instanceTypes: [new ec2.InstanceType("m3.medium")],
      desiredSize: 2,
      diskSize: 20,
      nodeRole: EksClusterRole,
    });

    // Managed Addon: kube-proxy
    const kubeProxy = new eks.CfnAddon(this, "addonKubeProxy", {
      addonName: "kube-proxy",
      clusterName: this.cluster.clusterName,
    });
  }
}
