cmake_minimum_required(VERSION 3.15)
project(AshkeGhalamNative LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(AshkeGhalam WIN32 main.cpp)

target_link_libraries(AshkeGhalam PRIVATE
    user32
    shell32
    ole32
    oleaut32
)
