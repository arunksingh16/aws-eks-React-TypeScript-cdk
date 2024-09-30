import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export class VpcStack extends cdk.Stack {
    public readonly vpc: ec2.Vpc;
    public readonly ecrRepository: ecr.Repository;
    public readonly ekssecuritygroup: ec2.SecurityGroup;
    public readonly BastionHostRole: iam.Role;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.vpc = new ec2.Vpc(this, 'MyVpc', {
            maxAzs: 2, // Default is all AZs in the region
            natGateways: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'public-subnet',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'private-subnet',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
        });

        // create ecr repository
        
        this.ecrRepository = new ecr.Repository(this, 'EcrRepository', {
            repositoryName: 'eks-repository',
        });

        const bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionHostSecurityGroup', {
            vpc:  this.vpc,
            allowAllOutbound: true,
            allowAllIpv6Outbound: true,
            securityGroupName: 'BastionHostSecurityGroup',
        });
        bastionSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow inbound SSH traffic');


        this.BastionHostRole = new iam.Role(this, 'BastionHostRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSServicePolicy')
            ],
          });

        const bastion = new ec2.Instance(this, 'BastionHost', {
            vpc:  this.vpc,
            instanceType: new ec2.InstanceType('t3.micro'),
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            machineImage: new ec2.AmazonLinuxImage(
              {
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
                edition: ec2.AmazonLinuxEdition.STANDARD,
              }
            ),
            keyName: 'arun', // If you want SSH access
            role: this.BastionHostRole,
            associatePublicIpAddress: true,
            securityGroup: bastionSecurityGroup,  // Create or use an existing security group
          });
      
          bastion.addToRolePolicy(new iam.PolicyStatement({
            actions: ['eks:DescribeCluster'],
            resources: ['*'],
          }));


          this.ekssecuritygroup = new ec2.SecurityGroup(this, 'EKSSecurityGroup', {
            vpc: this.vpc,
            allowAllOutbound: true,
            securityGroupName: 'EKSSecurityGroup',
          });
          
          this.ekssecuritygroup.addIngressRule(bastionSecurityGroup, ec2.Port.tcp(443), 'Allow inbound HTTPS traffic');

          bastion.addUserData(
            'sudo yum update -y',
            // Install AWS CLI v2
            'curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"',
            'unzip awscliv2.zip',
            'sudo ./aws/install',
            // Install eksctl
            'curl --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz" | tar xz -C /tmp',
            'sudo mv /tmp/eksctl /usr/local/bin',
            // Install kubectl
            'curl -O https://s3.us-west-2.amazonaws.com/amazon-eks/1.31.0/2024-09-12/bin/linux/amd64/kubectl',
            'sudo chmod +x ./kubectl',
            'sudo mv ./kubectl /usr/local/bin',
          );
    }
}