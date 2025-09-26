from setuptools import setup, find_packages

setup(
    name="kryos-sdk",
    version="0.1.0",
    description="Kryos Python SDK for cloud security + blockchain logging",
    author="Shubham",
    author_email="nerd.shubh.dev@gmail.com",
    url="https://github.com/Shubh1127/kryos-SDK",
    packages=find_packages(),
    install_requires=[
        "requests"
    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "Operating System :: OS Independent",
    ],
)
