# Use AWS official Python 3.11 base image (Amazon Linux 2023)
FROM public.ecr.aws/lambda/python:3.11

# 1. Update System & Install Compilers
# 'dnf' is the package manager for Amazon Linux 2023
# We install GCC (for C++), Java 17 Development Kit, and cleanup to keep image small
RUN yum update -y && \
    yum install -y gcc gcc-c++ java-17-amazon-corretto-devel && \
    yum clean all


# 2. Copy the Logic Script
# ${LAMBDA_TASK_ROOT} is the internal directory where Lambda expects code
COPY lambda_function.py ${LAMBDA_TASK_ROOT}

# 3. Set the Entry Point
CMD [ "lambda_function.handler" ]